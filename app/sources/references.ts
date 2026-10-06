export interface InitiativeReference {
  tag: string;
  initiative: string;
  authors: string;
  year: string;
  title: string;
  venue: string;
  url: string;
  volume?: string;
  issue?: string;
  pages?: string;
  articleNumber?: string;
  note?: string;
}

// Verified against Crossref and publisher/project pages on 2026-09-28.
// See data/initiative-data/initiative-references/verification.json for selection notes.
export const initiativeReferences: InitiativeReference[] = [
  {
    "tag": "BRI",
    "initiative": "Brazilian Reproducibility Initiative",
    "authors": "The Brazilian Reproducibility Initiative, et al.",
    "year": "2025",
    "title": "Estimating the replicability of Brazilian biomedical science",
    "venue": "bioRxiv",
    "url": "https://doi.org/10.1101/2025.04.02.645026",
    "note": "Preprint reporting the Brazilian Reproducibility Initiative."
  },
  {
    "tag": "socsci_2026",
    "initiative": "DARPA SCORE Social and Behavioural Sciences Replication Project",
    "authors": "A. H. Tyner, et al.",
    "year": "2026",
    "title": "Investigating the replicability of the social and behavioural sciences",
    "venue": "Nature",
    "url": "https://doi.org/10.1038/s41586-025-10078-y",
    "volume": "652",
    "issue": "8108",
    "pages": "143–150"
  },
  {
    "tag": "DataReplicada",
    "initiative": "Data Replicada — Data Colada Replication Series",
    "authors": "J. P. Simmons, et al.",
    "year": "2019, December 9",
    "title": "Data Replicada",
    "venue": "Data Colada",
    "articleNumber": "Post 81",
    "url": "https://datacolada.org/81"
  },
  {
    "tag": "ScarcityPNAS",
    "initiative": "Empirical Audit of Scarcity Research",
    "authors": "M. O’Donnell, et al.",
    "year": "2021",
    "title": "Empirical audit and review and an assessment of evidentiary value in research on the psychological consequences of scarcity",
    "venue": "Proceedings of the National Academy of Sciences",
    "url": "https://doi.org/10.1073/pnas.2103313118",
    "volume": "118",
    "issue": "44",
    "articleNumber": "e2103313118"
  },
  {
    "tag": "EROE",
    "initiative": "Examining Replicability of Online Experiments",
    "authors": "F. Holzmeister, et al.",
    "year": "2025",
    "title": "Examining the replicability of online experiments selected by a decision market",
    "venue": "Nature Human Behaviour",
    "url": "https://doi.org/10.1038/s41562-024-02062-9",
    "volume": "9",
    "issue": "2",
    "pages": "316–330"
  },
  {
    "tag": "ExECON",
    "initiative": "Experimental Economics Replications",
    "authors": "C. F. Camerer, et al.",
    "year": "2016",
    "title": "Evaluating replicability of laboratory experiments in economics",
    "venue": "Science",
    "url": "https://doi.org/10.1126/science.aaf0918",
    "volume": "351",
    "issue": "6280",
    "pages": "1433–1436"
  },
  {
    "tag": "XPHIR",
    "initiative": "Experimental Philosophy Reproducibility Project",
    "authors": "F. Cova, et al.",
    "year": "2021",
    "title": "Estimating the Reproducibility of Experimental Philosophy",
    "venue": "Review of Philosophy and Psychology",
    "url": "https://doi.org/10.1007/s13164-018-0400-9",
    "volume": "12",
    "issue": "1",
    "pages": "9–44"
  },
  {
    "tag": "3ie",
    "initiative": "International Initiative for Impact Evaluation — Replication Paper Series",
    "authors": "International Initiative for Impact Evaluation (3ie)",
    "year": "n.d.",
    "title": "Replication papers",
    "venue": "3ie",
    "url": "https://www.3ieimpact.org/evidence-hub/publications/replication-papers",
    "note": "(Official index of the replication paper series. Accessed Spring 2026.)"
  },
  {
    "tag": "Soto et al LOPPRP",
    "initiative": "Life Outcomes of Personality Replication Project",
    "authors": "C. J. Soto",
    "year": "2019",
    "title": "How Replicable Are Links Between Personality Traits and Consequential Life Outcomes? The Life Outcomes of Personality Replication Project",
    "venue": "Psychological Science",
    "url": "https://doi.org/10.1177/0956797619831612",
    "volume": "30",
    "issue": "5",
    "pages": "711–727"
  },
  {
    "tag": "ML1",
    "initiative": "Many Labs 1",
    "authors": "R. A. Klein, et al.",
    "year": "2014",
    "title": "Investigating Variation in Replicability: A “Many Labs” Replication Project",
    "venue": "Social Psychology",
    "url": "https://doi.org/10.1027/1864-9335/a000178",
    "volume": "45",
    "issue": "3",
    "pages": "142–152"
  },
  {
    "tag": "ML2",
    "initiative": "Many Labs 2",
    "authors": "R. A. Klein, et al.",
    "year": "2018",
    "title": "Many Labs 2: Investigating Variation in Replicability Across Samples and Settings",
    "venue": "Advances in Methods and Practices in Psychological Science",
    "url": "https://doi.org/10.1177/2515245918810225",
    "volume": "1",
    "issue": "4",
    "pages": "443–490"
  },
  {
    "tag": "ML3",
    "initiative": "Many Labs 3",
    "authors": "C. R. Ebersole, et al.",
    "year": "2016",
    "title": "Many Labs 3: Evaluating participant pool quality across the academic semester via replication",
    "venue": "Journal of Experimental Social Psychology",
    "url": "https://doi.org/10.1016/j.jesp.2015.10.012",
    "volume": "67",
    "pages": "68–82"
  },
  {
    "tag": "ML4",
    "initiative": "Many Labs 4",
    "authors": "R. A. Klein, et al.",
    "year": "2022",
    "title": "Many Labs 4: Failure to Replicate Mortality Salience Effect With and Without Original Author Involvement",
    "venue": "Collabra: Psychology",
    "url": "https://doi.org/10.1525/collabra.35271",
    "volume": "8",
    "issue": "1",
    "articleNumber": "35271"
  },
  {
    "tag": "ML5",
    "initiative": "Many Labs 5",
    "authors": "C. R. Ebersole, et al.",
    "year": "2020",
    "title": "Many Labs 5: Testing Pre-Data-Collection Peer Review as an Intervention to Increase Replicability",
    "venue": "Advances in Methods and Practices in Psychological Science",
    "url": "https://doi.org/10.1177/2515245920958687",
    "volume": "3",
    "issue": "3",
    "pages": "309–331"
  },
  {
    "tag": "RRR",
    "initiative": "Registered Replication Reports",
    "authors": "D. J. Simons, et al.",
    "year": "2014",
    "title": "An Introduction to Registered Replication Reports at Perspectives on Psychological Science",
    "venue": "Perspectives on Psychological Science",
    "url": "https://doi.org/10.1177/1745691614543974",
    "volume": "9",
    "issue": "5",
    "pages": "552–555",
    "note": "Introduction to the Registered Replication Reports series."
  },
  {
    "tag": "RSESR",
    "initiative": "Replicability of Sports and Exercise Science Research",
    "authors": "J. Murphy, et al.",
    "year": "2025",
    "title": "Estimating the Replicability of Sports and Exercise Science Research",
    "venue": "Sports Medicine",
    "url": "https://doi.org/10.1007/s40279-025-02201-w",
    "volume": "55",
    "issue": "10",
    "pages": "2659–2679"
  },
  {
    "tag": "L2R:Marsden2018",
    "initiative": "Replication in Second Language Research",
    "authors": "E. Marsden, et al.",
    "year": "2018",
    "title": "Replication in Second Language Research: Narrative and Systematic Reviews and Recommendations for the Field",
    "venue": "Language Learning",
    "url": "https://doi.org/10.1111/lang.12286",
    "volume": "68",
    "issue": "2",
    "pages": "321–391"
  },
  {
    "tag": "RP:CB",
    "initiative": "Reproducibility Project: Cancer Biology",
    "authors": "T. M. Errington, et al.",
    "year": "2021",
    "title": "Investigating the replicability of preclinical cancer biology",
    "venue": "eLife",
    "url": "https://doi.org/10.7554/eLife.71601",
    "volume": "10",
    "articleNumber": "e71601"
  },
  {
    "tag": "RP:P",
    "initiative": "Reproducibility Project: Psychology",
    "authors": "Open Science Collaboration",
    "year": "2015",
    "title": "Estimating the reproducibility of psychological science",
    "venue": "Science",
    "url": "https://doi.org/10.1126/science.aac4716",
    "volume": "349",
    "issue": "6251",
    "articleNumber": "aac4716"
  },
  {
    "tag": "SMR",
    "initiative": "Sensory Marketing Replications",
    "authors": "K. Motoki, et al.",
    "year": "2022",
    "title": "Evaluating replicability of ten influential research on sensory marketing",
    "venue": "Frontiers in Communication",
    "url": "https://doi.org/10.3389/fcomm.2022.1048896",
    "volume": "7",
    "articleNumber": "1048896"
  },
  {
    "tag": "SPRRR",
    "initiative": "Social Psychology Special Issue on Registered Replication Reports",
    "authors": "B. A. Nosek, et al.",
    "year": "2014",
    "title": "Registered Reports: A Method to Increase the Credibility of Published Results",
    "venue": "Social Psychology",
    "url": "https://doi.org/10.1027/1864-9335/a000192",
    "volume": "45",
    "issue": "3",
    "pages": "137–141"
  },
  {
    "tag": "SSRP",
    "initiative": "Social Science Replication Project",
    "authors": "C. F. Camerer, et al.",
    "year": "2018",
    "title": "Evaluating the replicability of social science experiments in Nature and Science between 2010 and 2015",
    "venue": "Nature Human Behaviour",
    "url": "https://doi.org/10.1038/s41562-018-0399-z",
    "volume": "2",
    "issue": "9",
    "pages": "637–644"
  },
  {
    "tag": "SRP",
    "initiative": "Student Replication Projects",
    "authors": "V. Boyce, et al.",
    "year": "2023",
    "title": "Eleven years of student replication projects provide evidence on the correlates of replicability in psychology",
    "venue": "Royal Society Open Science",
    "url": "https://doi.org/10.1098/rsos.231240",
    "volume": "10",
    "issue": "11",
    "articleNumber": "231240"
  }
];
