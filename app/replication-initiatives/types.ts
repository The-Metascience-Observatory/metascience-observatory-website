export interface Project {
  id: string;
  /** URL-hash anchor for deep-linking to this initiative. */
  slug: string;
  field: string;
  year?: string;
  name: string;
  replicatedCount?: string;
  totalCount?: string;
  replicationRate?: string;
  effectSizeDecline?: string;
  description?: string;
  authors?: string;
  projectUrl?: string;
  paperUrl?: string;
  tag?: string;
}

export interface FieldGroup {
  field: string;
  projects: Project[];
}
