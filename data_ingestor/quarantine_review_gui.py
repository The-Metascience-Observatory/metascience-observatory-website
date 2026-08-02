"""
PyQt5 GUI for reviewing quarantined rows during ingestion.

Launched by data_ingestor.py when incoming rows fail a REJECT-severity
validation rule (see validation_rules.py). For each row the user can:

  - Fix & ingest        edit any field; edits are re-validated on Apply and the
                        window will not accept a row that still fails a rule
  - Blank offending fields & ingest
                        clear exactly the cells that failed, keep the rest
  - Reject entire row   do not ingest

Every decision (original values, final values, action, comment) is logged by
the caller to data/quarantine_log.jsonl.

The default action is "Fix & ingest" with the row unedited — which still fails
validation — so no quarantined row can slip through without an explicit choice.
"""

import sys
import math
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QComboBox, QPushButton, QScrollArea, QFrame, QLineEdit,
    QGridLayout, QGroupBox, QStackedWidget, QPlainTextEdit, QMessageBox,
)
from PyQt5.QtCore import Qt

from validation_rules import has_rejects

ACTION_FIX = "Fix & ingest"
ACTION_BLANK = "Blank offending fields & ingest"
ACTION_REJECT = "Reject entire row"


def _norm(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ''
    s = str(v).strip()
    return '' if s.lower() == 'nan' else s


class QuarantineCard(QWidget):
    """One quarantined incoming row: violations, editable fields, action."""

    def __init__(self, incoming_idx, incoming_row, violations, parent=None):
        super().__init__(parent)
        self.incoming_idx = incoming_idx
        self.original_values = {col: _norm(incoming_row.get(col))
                                for col in incoming_row.index}
        self.violations = violations
        self.reject_cols = {v.column for v in violations if v.severity == 'reject'}
        flagged_cols = {v.column for v in violations}

        outer = QVBoxLayout(self)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        body = QWidget()
        layout = QVBoxLayout(body)

        # ── Header: action ──
        header_frame = QFrame()
        header_frame.setFrameShape(QFrame.StyledPanel)
        header_frame.setStyleSheet(
            "QFrame { background: #fdecea; border: 1px solid #d93025; }")
        hf_layout = QVBoxLayout(header_frame)
        hf_layout.setContentsMargins(8, 6, 8, 6)

        top = QHBoxLayout()
        n_rej = sum(1 for v in violations if v.severity == 'reject')
        n_flag = len(violations) - n_rej
        top.addWidget(QLabel(
            f"<b>QUARANTINED ROW</b> — {n_rej} blocking violation(s)"
            + (f", {n_flag} warning(s)" if n_flag else "")))
        top.addStretch()
        top.addWidget(QLabel("<b>Action:</b>"))
        self.action_combo = QComboBox()
        self.action_combo.addItems([ACTION_FIX, ACTION_BLANK, ACTION_REJECT])
        self.action_combo.setMinimumWidth(240)
        top.addWidget(self.action_combo)
        hf_layout.addLayout(top)

        desc = self.original_values.get('description', '')
        if desc:
            desc_label = QLabel(f"<i>{desc}</i>")
            desc_label.setWordWrap(True)
            desc_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
            hf_layout.addWidget(desc_label)

        # ── Violation list ──
        for v in violations:
            color = "#d93025" if v.severity == 'reject' else "#b35900"
            sym = "✖" if v.severity == 'reject' else "⚠"
            vlabel = QLabel(
                f"<span style='color:{color}'>{sym} <b>{v.column}</b> = "
                f"{v.value or '(blank)'} — {v.message}</span>")
            vlabel.setWordWrap(True)
            vlabel.setTextInteractionFlags(Qt.TextSelectableByMouse)
            hf_layout.addWidget(vlabel)
        layout.addWidget(header_frame)

        # ── Editable field grid ──
        # Offending fields first, then every other non-empty field.
        panel = QGroupBox("Row fields — edit values, or clear a cell to blank it")
        grid = QGridLayout(panel)
        grid.setVerticalSpacing(3)

        cols_in_order = ([c for c in self.original_values if c in flagged_cols] +
                         [c for c, val in self.original_values.items()
                          if c not in flagged_cols and val])
        self.field_edits = {}
        for r, col in enumerate(cols_in_order):
            val = self.original_values[col]
            name = QLabel(f"<b>{col}</b>")
            edit = QLineEdit(val)
            if col in self.reject_cols:
                name.setStyleSheet("color: #d93025;")
                edit.setStyleSheet(
                    "QLineEdit { background: #fdecea; border: 1px solid #d93025; }")
            elif col in flagged_cols:
                name.setStyleSheet("color: #b35900;")
                edit.setStyleSheet(
                    "QLineEdit { background: #fff8f0; border: 1px solid #e07000; }")
            self.field_edits[col] = edit
            grid.addWidget(name, r, 0)
            grid.addWidget(edit, r, 1)
        grid.setColumnStretch(1, 1)
        layout.addWidget(panel)

        # ── Comment ──
        layout.addWidget(QLabel("<b>Comment</b> (recorded in data/quarantine_log.jsonl):"))
        self.comment_edit = QPlainTextEdit()
        self.comment_edit.setPlaceholderText(
            "Why the value was wrong / what the fix was based on…")
        self.comment_edit.setMaximumHeight(60)
        layout.addWidget(self.comment_edit)

        layout.addStretch()
        scroll.setWidget(body)
        outer.addWidget(scroll)

    def final_row(self):
        """The row as it would be ingested under the current action, or None."""
        action = self.action_combo.currentText()
        if action == ACTION_REJECT:
            return None
        final = dict(self.original_values)
        for col, edit in self.field_edits.items():
            final[col] = edit.text().strip()
        if action == ACTION_BLANK:
            for col in self.reject_cols:
                final[col] = ''
        return final

    def get_decision(self):
        action = self.action_combo.currentText()
        action_key = {ACTION_FIX: 'fixed', ACTION_BLANK: 'blanked',
                      ACTION_REJECT: 'rejected'}[action]
        return {
            'incoming_idx': self.incoming_idx,
            'action': action_key,
            'final_row': self.final_row(),
            'comment': self.comment_edit.toPlainText().strip(),
            'violations': self.violations,
        }


class QuarantineReviewWindow(QMainWindow):
    """Paginated review of all quarantined rows; Apply re-validates fixes."""

    def __init__(self, quarantined, processed_df, validator):
        """
        Args:
            quarantined: list of (incoming_idx, [Violation]) tuples
            processed_df: the processed incoming DataFrame
            validator: a validation_rules.RowValidator (re-checks edited rows)
        """
        super().__init__()
        self.validator = validator
        self.results = None
        self.current_idx = 0

        self.setWindowTitle("Quarantine Review — rows failing validation")
        self.setMinimumSize(700, 450)
        screen = QApplication.primaryScreen()
        if screen is not None:
            avail = screen.availableGeometry()
            self.resize(min(1200, int(avail.width() * 0.9)),
                        min(850, int(avail.height() * 0.9)))
        else:
            self.resize(1200, 850)

        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)

        summary = QLabel(
            f"<b>{len(quarantined)}</b> row(s) failed a hard validation rule and "
            f"will NOT be ingested until fixed, blanked, or rejected. "
            f"All decisions are logged to data/quarantine_log.jsonl.")
        summary.setWordWrap(True)
        summary.setStyleSheet("font-size: 14px; padding: 6px;")
        main_layout.addWidget(summary)

        # Navigation
        nav_bar = QHBoxLayout()
        self.prev_btn = QPushButton("◀  Prev")
        self.prev_btn.setMinimumHeight(32)
        self.prev_btn.setMinimumWidth(100)
        self.prev_btn.clicked.connect(self._prev)
        nav_bar.addWidget(self.prev_btn)
        nav_bar.addStretch()
        self.page_label = QLabel()
        self.page_label.setStyleSheet("font-size: 15px; font-weight: bold;")
        self.page_label.setAlignment(Qt.AlignCenter)
        nav_bar.addWidget(self.page_label)
        nav_bar.addStretch()
        self.next_btn = QPushButton("Next  ▶")
        self.next_btn.setMinimumHeight(32)
        self.next_btn.setMinimumWidth(100)
        self.next_btn.clicked.connect(self._next)
        nav_bar.addWidget(self.next_btn)
        main_layout.addLayout(nav_bar)

        self.stack = QStackedWidget()
        self.cards = []
        for idx, violations in quarantined:
            card = QuarantineCard(idx, processed_df.loc[idx], violations)
            self.cards.append(card)
            self.stack.addWidget(card)
        main_layout.addWidget(self.stack)

        button_bar = QHBoxLayout()
        button_bar.addStretch()
        apply_btn = QPushButton("Apply All Decisions")
        apply_btn.setMinimumHeight(40)
        apply_btn.setMinimumWidth(200)
        apply_btn.setStyleSheet(
            "QPushButton { background: #d93025; color: white; font-size: 14px; "
            "font-weight: bold; border-radius: 4px; } "
            "QPushButton:hover { background: #b3261e; }")
        apply_btn.clicked.connect(self._apply)
        button_bar.addWidget(apply_btn)
        button_bar.addStretch()
        main_layout.addLayout(button_bar)

        self._update_nav()

    def _update_nav(self):
        total = len(self.cards)
        self.page_label.setText(f"{self.current_idx + 1} / {total}")
        self.prev_btn.setEnabled(self.current_idx > 0)
        self.next_btn.setEnabled(self.current_idx < total - 1)
        self.stack.setCurrentIndex(self.current_idx)

    def _prev(self):
        if self.current_idx > 0:
            self.current_idx -= 1
            self._update_nav()

    def _next(self):
        if self.current_idx < len(self.cards) - 1:
            self.current_idx += 1
            self._update_nav()

    def _apply(self):
        """Re-validate every non-rejected row; refuse to close while any still fails."""
        for i, card in enumerate(self.cards):
            final = card.final_row()
            if final is None:
                continue
            still = self.validator.validate_row(final)
            if has_rejects(still):
                self.current_idx = i
                self._update_nav()
                msgs = "\n".join(
                    f"• {v.column} = {v.value or '(blank)'} — {v.message}"
                    for v in still if v.severity == 'reject')
                QMessageBox.warning(
                    self, "Row still fails validation",
                    f"Row {i + 1} of {len(self.cards)} still fails:\n\n{msgs}\n\n"
                    f"Fix the highlighted fields, blank them, or reject the row.")
                return
        self.results = [card.get_decision() for card in self.cards]
        self.close()

    def get_results(self):
        return self.results


def launch_quarantine_review(quarantined, processed_df, validator):
    """Launch the GUI and return user decisions. Blocks until window closes.

    Returns a list of decision dicts, or None if the window was closed without
    Apply (caller should treat that as 'quarantine everything, decide later').
    """
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)

    font = app.font()
    if font.pointSize() > 9:
        font.setPointSize(9)
        app.setFont(font)

    window = QuarantineReviewWindow(quarantined, processed_df, validator)
    window.show()
    app.exec_()
    return window.get_results()
