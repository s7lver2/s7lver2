import type { ConceptKey } from './content';
export type { ConceptKey };

// Keywords (lowercase) found in htbmachines `skills` that count toward each axis.
export const CONCEPT_AXES: Record<ConceptKey, string[]> = {
  web:    ['web', 'sqli', 'sql injection', 'xss', 'lfi', 'rfi', 'rce', 'ssrf', 'ssti', 'upload', 'idor', 'jwt', 'deserialization', 'xxe'],
  net:    ['network', 'pivoting', 'tunnel', 'port forward', 'smb', 'snmp', 'nfs', 'ftp', 'dns', 'proxychains'],
  recon:  ['enumeration', 'recon', 'osint', 'information gathering', 'subdomain', 'fuzzing'],
  ad:     ['active directory', 'kerberos', 'kerberoasting', 'bloodhound', 'ntlm', 'asreproast', 'dcsync', 'ldap', 'gpo'],
  rev:    ['reversing', 'reverse engineering', 'binary', 'buffer overflow', 'bof', 'pwn', 'ghidra', 'debugging'],
  crypto: ['crypto', 'cryptography', 'hash', 'rsa', 'aes', 'cipher', 'encryption'],
};

export function skillsToAxisKeys(skills: string): ConceptKey[] {
  const s = (skills || '').toLowerCase();
  const out: ConceptKey[] = [];
  (Object.keys(CONCEPT_AXES) as ConceptKey[]).forEach((axis) => {
    if (CONCEPT_AXES[axis].some((kw) => s.includes(kw))) out.push(axis);
  });
  return out;
}
