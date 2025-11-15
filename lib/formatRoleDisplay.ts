const GENERAL_KEYWORDS = new Set(["general"]);

function normalizeRole(value: string): string {
  return value
    .replace(/[_\s]+/g, " ")
    .trim()
    .toLowerCase();
}

function formatRoleValue(value: string): string {
  return value
    .replace(/[_\s]+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function formatRoleDisplay(primary?: string | null, secondaries?: (string | null | undefined)[] | null): string | undefined {
  const roles: string[] = [];
  const seen = new Set<string>();

  const addRole = (value?: string | null) => {
    if (!value) {
      return;
    }
    const normalized = normalizeRole(value);
    if (!normalized || GENERAL_KEYWORDS.has(normalized) || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    roles.push(formatRoleValue(value));
  };

  addRole(primary);
  if (Array.isArray(secondaries)) {
    secondaries.forEach((role) => {
      if (roles.length >= 2) {
        return;
      }
      addRole(role);
    });
  }

  if (roles.length === 0) {
    return undefined;
  }

  return roles.join(" / ");
}
