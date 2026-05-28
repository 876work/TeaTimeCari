export const trimName = (value: string): string => value.trim();

export const fullName = (firstName: string, lastName: string): string => {
  return [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
};
