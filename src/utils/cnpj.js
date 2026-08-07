// Validação e formatação de CNPJ — usada no frontend e nas funções backend.
// Algoritmo oficial: dois dígitos verificadores por módulo 11.

export function cnpjNumeros(cnpj) {
  return (cnpj || "").replace(/\D/g, "");
}

export function cnpjFormatado(cnpj) {
  const n = cnpjNumeros(cnpj);
  if (n.length !== 14) return cnpj;
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
}

export function validarCNPJ(cnpj) {
  const n = cnpjNumeros(cnpj);
  if (n.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(n)) return false; // todos iguais

  const calc = (len) => {
    let sum = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(n[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  return calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13]);
}

// Retorna { valido, formatado, erro }
export function verificarCNPJ(cnpj) {
  const n = cnpjNumeros(cnpj);
  if (!cnpj || n.length === 0) return { valido: false, formatado: "", erro: "CNPJ obrigatório." };
  if (n.length !== 14) return { valido: false, formatado: cnpj, erro: "CNPJ incompleto — deve ter 14 dígitos." };
  if (!validarCNPJ(n)) return { valido: false, formatado: cnpj, erro: "CNPJ inválido — dígitos verificadores incorretos." };
  return { valido: true, formatado: cnpjFormatado(n), erro: null };
}
