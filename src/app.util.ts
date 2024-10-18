export const formatGender = (gender: string): string => {
  if (gender === 'Male' || gender === 'male') return 'M';
  if (gender === 'Female' || gender === 'female') return 'F';
  return gender;
};
