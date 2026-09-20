export type PartialDate = "" | `${number}${number}${number}${number}` | `${number}${number}-${number}${number}${number}${number}`;

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
}

export interface Experience {
  title: string;
  company: string;
  location: string;
  startDate: PartialDate;
  endDate: PartialDate;
  achievements: string[];
}

export interface Education {
  institution: string;
  program: string;
  startDate: PartialDate;
  endDate: PartialDate;
  description: string;
}

export interface Skills {
  hard: string[];
  soft: string[];
}

export interface Language {
  name: string;
  proficiency: string;
}

export interface Certification {
  name: string;
  issuer: string;
  issueDate: PartialDate;
  expirationDate: PartialDate;
  credential: string;
}

export interface StructuredCv {
  personalInfo: PersonalInfo;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: Skills;
  languages: Language[];
  certifications: Certification[];
}
