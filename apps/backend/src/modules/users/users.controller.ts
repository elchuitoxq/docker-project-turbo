import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  AssignBranchesDto,
  AssignRolesDto,
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('settings:users:view')
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieves a list of all registered users with their roles',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [UserResponseDto],
  })
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('settings:users:view')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves a specific user by their ID',
  })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions('settings:users:create')
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Creates a user account; role and branch assignments use separate protected endpoints',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @RequirePermissions('settings:users:edit')
  @ApiOperation({
    summary: 'Update a user',
    description: "Updates an existing user's information",
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions('settings:users:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Deletes a user and their role assignments',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings:users:manage')
  @ApiOperation({
    summary: 'Assign roles to a user',
    description: "Replaces the user's current roles with the specified roles",
  })
  @ApiBody({ type: AssignRolesDto })
  @ApiResponse({
    status: 200,
    description: 'Roles assigned successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async assignRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto
  ): Promise<UserResponseDto> {
    return this.usersService.assignRoles(id, assignRolesDto.roleIds);
  }

  @Post(':id/branches')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings:users:manage')
  @ApiBody({ type: AssignBranchesDto })
  async assignBranches(
    @Param('id') id: string,
    @Body() assignBranchesDto: AssignBranchesDto
  ): Promise<UserResponseDto> {
    return this.usersService.assignBranches(
      id,
      assignBranchesDto.branchIds,
      assignBranchesDto.defaultBranchId
    );
  }

  @Get('me/profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieves the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserResponseDto,
  })
  async getProfile(@CurrentUser() user: CurrentUserData): Promise<UserResponseDto> {
    return this.usersService.findOne(user.id);
  }
}
