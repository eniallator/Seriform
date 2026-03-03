export const formatField = (value: string | null): string =>
  value?.replaceAll(/[,\\]/g, String.raw`\$&`) ?? "";

export const splitQueryValues = (query: string): (string | null)[] => {
  const out: (string | null)[] = [];

  let value: string = "";
  let escaped = false;
  for (const char of query) {
    if (escaped) {
      value += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === ",") {
      out.push(value.length > 0 ? value : null);
      value = "";
    } else {
      value += char;
    }
  }

  if (query.length > 0) {
    out.push(value.length > 0 ? value : null);
  }

  return out;
};
