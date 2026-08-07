/** Valida CNPJ com o algoritmo oficial (dígitos verificadores) e devolve a
 * versão só com números. */
export function validarCNPJ(cnpj: string | undefined | null): { ok: boolean; nums: string } {
  const n = (cnpj || '').replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return { ok: false, nums: n };
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const ok = calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13]);
  return { ok, nums: n };
}

/** Formata CNPJ (14 dígitos) no padrão XX.XXX.XXX/XXXX-XX. */
export function formatarCNPJ(nums: string): string {
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
}

/** Normaliza a vertical recebida do CRM ("Retail - BSB", "Moda - X") para o
 * código canônico usado internamente. */
export function normalizarVertical(vertical: string): string {
  const v = vertical.toLowerCase();
  if (v.startsWith('retail')) return 'retail';
  if (v.startsWith('food')) return 'food';
  if (v.startsWith('farma')) return 'farma';
  if (v.startsWith('moda')) return 'retail'; // Moda faz parte da vertical Retail
  return v.split(' ')[0];
}
