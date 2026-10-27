import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Sucursal activa ya validada por `BranchContextGuard`. */
export const CurrentBranch = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ branchId?: string | null }>();
  if (!request.branchId) {
    throw new BadRequestException('Branch context is not available for this endpoint');
  }
  return request.branchId;
});
