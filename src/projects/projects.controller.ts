import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { WorkloadService } from './workload.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums';
import { User } from '../users/entities/user.entity';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly workloadService: WorkloadService,
  ) {}

  @Get('deleted')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findDeleted() {
    return this.projectsService.findDeleted();
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':projectId/workload')
  getWorkload(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.workloadService.getWorkload(projectId);
  }

  @Get(':projectId')
  findOne(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.projectsService.findOne(projectId);
  }

  @HttpCode(200)
  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    return this.projectsService.create(dto, user.id);
  }

  @HttpCode(200)
  @Patch(':projectId')
  update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.update(projectId, dto, user.id);
  }

  @HttpCode(200)
  @Delete(':projectId')
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ) {
    await this.projectsService.softDelete(projectId, user.id);
    return {};
  }

  @HttpCode(200)
  @Post(':projectId/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  restore(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ) {
    return this.projectsService.restore(projectId, user.id);
  }
}
