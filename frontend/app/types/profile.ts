export type BasicProfile = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
};

export type BasicProfileResponse = BasicProfile | null;