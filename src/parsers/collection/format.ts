export const formatField = (value: string | null | undefined): string =>
  value?.replaceAll(/[,\\]/g, String.raw`\$&`) ?? "";

export const splitQueryValues = (query: string): (string | null)[] =>
  query.length > 0
    ? query.split(/(?<!(?<!\\)\\(?:\\\\)*),/).map(part => {
        const unescaped = part.replaceAll(/\\([,\\])/g, "$1");
        return unescaped.length > 0 ? unescaped : null;
      })
    : [];
