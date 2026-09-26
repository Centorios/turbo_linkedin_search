export type BasicProfile = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  photoPath?: string | null;
};

export type BasicProfileResponse = BasicProfile | null;