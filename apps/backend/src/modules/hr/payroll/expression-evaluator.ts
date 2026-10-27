import { tokenizeExpression } from './concept-expression';

/**
 * Evaluador de las fórmulas de concepto (`T-02-03`).
 *
 * Comparte el alfabeto con `validateConceptExpression`: lo que el alta rechaza, el motor no lo ve.
 * Sólo resuelve aritmética sobre las variables del período; no hay funciones, ni acceso al entorno,
 * ni forma de ejecutar código.
 */

export class ExpressionEvaluationError extends Error {}

class Evaluator {
  private position = 0;

  constructor(
    private readonly tokens: string[],
    private readonly variables: Record<string, number>,
    private readonly expression: string
  ) {}

  evaluate(): number {
    const value = this.parseExpression();
    if (this.position < this.tokens.length) {
      throw new ExpressionEvaluationError(
        `Símbolo inesperado "${this.tokens[this.position]}" en la fórmula "${this.expression}"`
      );
    }

    if (!Number.isFinite(value)) {
      throw new ExpressionEvaluationError(
        `La fórmula "${this.expression}" no produce un número finito`
      );
    }

    return value;
  }

  private peek(): string | undefined {
    return this.tokens[this.position];
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (this.peek() === '+' || this.peek() === '-') {
      const operator = this.tokens[this.position];
      this.position += 1;
      const right = this.parseTerm();
      value = operator === '+' ? value + right : value - right;
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (this.peek() === '*' || this.peek() === '/') {
      const operator = this.tokens[this.position];
      this.position += 1;
      const right = this.parseFactor();
      if (operator === '*') {
        value *= right;
      } else {
        if (right === 0) {
          throw new ExpressionEvaluationError(
            `División por cero en la fórmula "${this.expression}"`
          );
        }
        value /= right;
      }
    }

    return value;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (token === undefined) {
      throw new ExpressionEvaluationError(
        `La fórmula "${this.expression}" termina donde se esperaba un operando`
      );
    }

    if (token === '-' || token === '+') {
      this.position += 1;
      const value = this.parseFactor();
      return token === '-' ? -value : value;
    }

    if (token === '(') {
      this.position += 1;
      const value = this.parseExpression();
      if (this.peek() !== ')') {
        throw new ExpressionEvaluationError(`Paréntesis sin cerrar en "${this.expression}"`);
      }
      this.position += 1;
      return value;
    }

    this.position += 1;

    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return Number(token);
    }

    const value = this.variables[token];
    if (value === undefined) {
      throw new MissingVariableError(token, this.expression);
    }

    return value;
  }
}

/** El concepto usa una base que todavía no se calculó: la pasada siguiente lo resolverá. */
export class MissingVariableError extends ExpressionEvaluationError {
  constructor(
    readonly variable: string,
    expression: string
  ) {
    super(`La base "${variable}" no está disponible todavía en la fórmula "${expression}"`);
  }
}

/** Devuelve el valor de la expresión o lanza `ExpressionEvaluationError`. */
export function evaluateExpression(expression: string, variables: Record<string, number>): number {
  const tokens = tokenizeExpression(expression.trim());
  if (!tokens || tokens.length === 0) {
    throw new ExpressionEvaluationError(`La fórmula "${expression}" está vacía o mal formada`);
  }

  return new Evaluator(tokens, variables, expression).evaluate();
}
