import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MessageResponseDto } from '../../common/dto/api-response.dto';
import {
  CreateRoleDto,
  UpdateRoleDto,
  PermissionResponseDto,
  RoleResponseDto,
} from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('settings:roles:view')
  @ApiOperation({
    summary: 'Listar roles',
    description: 'Devuelve todos los roles con sus permisos asignados',
  })
  @ApiResponse({ status: 200, description: 'Lista de roles', type: [RoleResponseDto] })
  findAll(): Promise<RoleResponseDto[]> {
    return this.rolesService.findAll();
  }

  @Get('permissions')
  @RequirePermissions('settings:roles:view')
  @ApiOperation({
    summary: 'Listar catálogo de permisos',
    description: 'Permisos disponibles agrupables por módulo, para asignarlos a un rol',
  })
  @ApiResponse({
    status: 200,
    description: 'Catálogo de permisos',
    type: [PermissionResponseDto],
  })
  findPermissions(): Promise<PermissionResponseDto[]> {
    return this.rolesService.findPermissions();
  }

  @Get(':id')
  @RequirePermissions('settings:roles:view')
  @ApiOperation({
    summary: 'Obtener rol por ID',
    description: 'Devuelve el rol con el detalle de sus permisos',
  })
  @ApiParam({ name: 'id', description: 'UUID del rol' })
  @ApiResponse({ status: 200, description: 'Detalle del rol', type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  findOne(@Param('id') id: string): Promise<RoleResponseDto> {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermissions('settings:roles:manage')
  @ApiOperation({
    summary: 'Crear rol',
    description: 'Crea un rol y le asigna los permisos indicados',
  })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({ status: 201, description: 'Rol creado', type: RoleResponseDto })
  @ApiResponse({ status: 409, description: 'Ya existe un rol con ese nombre' })
  create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings:roles:manage')
  @ApiOperation({
    summary: 'Actualizar rol',
    description: 'Actualiza nombre, descripción y reemplaza los permisos asignados',
  })
  @ApiParam({ name: 'id', description: 'UUID del rol' })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({ status: 200, description: 'Rol actualizado', type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un rol con ese nombre' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings:roles:manage')
  @ApiOperation({
    summary: 'Eliminar rol',
    description: 'Elimina un rol. Los roles de sistema no se pueden eliminar',
  })
  @ApiParam({ name: 'id', description: 'UUID del rol' })
  @ApiResponse({ status: 200, description: 'Rol eliminado', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Los roles de sistema no se pueden eliminar' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  remove(@Param('id') id: string): Promise<MessageResponseDto> {
    return this.rolesService.remove(id);
  }
}
