export function getAuthShellState() {
  return {
    mode: "phone-verification-code",
    enabled: false
  } as const;
}
