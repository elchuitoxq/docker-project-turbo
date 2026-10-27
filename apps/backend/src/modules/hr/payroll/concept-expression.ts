/**
 * Validación de las fórmulas de conceptos de nómina (`T-02-02`).
 *
 * Un concepto declara su cálculo con una expresión (`payroll_concept_types.expression`) que el motor
 * evalúa al correr la nómina. Esta función **no evalúa nada**: sólo verifica que la expresión
 * pertenezca a una gramática mínima (números, identificadores permitidos, `+ - * /` y paréntesis).
 * Así una fórmula cargada por un usuario no puede ejecutar código arbitrario y además es auditable.
 */

/** Bases de cálculo que el motor expone a las fórmulas (ver `09-HR-NOMINA-VENEZUELA.md` §7). */
export const CONCEPT_BASES = [
  'SALARY_BASE',
  'SALARY_NORMAL',
  'SALARY_INTEGRAL',
  'PERIOD_DAYS',
  'MONTH_DAYS',
  'HOURS',
  'HOUR_RATE',
  'UNITS',
  'BASE_AMOUNT',
] as const;

const MAX_EXPRESSION_LENGTH = 200;
const TOKEN_RE = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[-+*/().])/y;

/** Devuelve los tokens de la expresión, o `null` si aparece un carácter fuera del alfabeto. */
export function tokenizeExpression(expression: string): string[] | null {
  const tokens: string[] = [];
  let index = 0;

  while (index < expression.length) {
    TOKEN_RE.lastIndex = index;
    const match = TOKEN_RE.exec(expression);
    if (!match) return null;
    tokens.push(match[1]);
    index = TOKEN_RE.lastIndex;
  }

  return tokens;
}

class ExpressionParser {
  private position = 0;

  constructor(
    private readonly tokens: string[],
    private readonly allowed: Set<string>
  ) {}

  parse(): string | null {
    const error = this.parseExpression();
    if (error) return error;

    const leftover = this.tokens[this.position];
    if (leftover !== undefined) {
      return `Símbolo inesperado "${leftover}"`;
    }

    return null;
  }

  private peek(): string | undefined {
    return this.tokens[this.position];
  }

  private parseExpression(): string | null {
    let error = this.parseTerm();
    if (error) return error;

    while (this.peek() === '+' || this.peek() === '-') {
      this.position += 1;
      error = this.parseTerm();
      if (error) return error;
    }

    return null;
  }

  private parseTerm(): string | null {
    let error = this.parseFactor();
    if (error) return error;

    while (this.peek() === '*' || this.peek() === '/') {
      this.position += 1;
      error = this.parseFactor();
      if (error) return error;
    }

    return null;
  }

  private parseFactor(): string | null {
    const token = this.peek();
    if (token === undefined) {
      return 'La expresión termina donde se esperaba un operando';
    }

    if (token === '-' || token === '+') {
      this.position += 1;
      return this.parseFactor();
    }

    if (token === '(') {
      this.position += 1;
      const error = this.parseExpression();
      if (error) return error;
      if (this.peek() !== ')') return 'Paréntesis sin cerrar';
      this.position += 1;
      return null;
    }

    if (token === ')') return 'Paréntesis de cierre sin apertura';

    if (/^\d+(?:\.\d+)?$/.test(token)) {
      this.position += 1;
      return null;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
      if (!this.allowed.has(token)) {
        return `Identificador desconocido "${token}"`;
      }
      this.position += 1;
      return null;
    }

    return `Símbolo inválido "${token}"`;
  }
}

/**
 * Valida una expresión de concepto.
 *
 * @param expression Fórmula declarada por el concepto.
 * @param extraIdentifiers Identificadores adicionales permitidos (por ejemplo claves de parámetros).
 * @returns Mensaje de error, o `null` si la expresión es válida.
 */
export function validateConceptExpression(
  expression: string,
  extraIdentifiers: string[] = []
): string | null {
  const trimmed = expression.trim();

  if (trimmed.length === 0) return 'La expresión está vacía';
  if (trimmed.length > MAX_EXPRESSION_LENGTH) {
    return `La expresión supera ${MAX_EXPRESSION_LENGTH} caracteres`;
  }

  const tokens = tokenizeExpression(trimmed);
  if (!tokens || tokens.length === 0) {
    return 'La expresión contiene caracteres no permitidos (sólo números, variables, + - * / y paréntesis)';
  }

  const allowed = new Set<string>([...CONCEPT_BASES, ...extraIdentifiers]);
  return new ExpressionParser(tokens, allowed).parse();
}
