import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ProfileStep,
  type BasicProfileInput,
  type CandidateProfile as CandidateProfileDto,
  type EducationStepInput,
  type Locale,
  type ProjectsStepInput,
  type SkillsStepInput,
} from '@ltwnc/shared';
import { DataSource, EntityManager } from 'typeorm';
import { CandidateProfile } from './entities/candidate-profile.entity';
import { CandidateSkill } from './entities/candidate-skill.entity';
import { Education } from './entities/education.entity';
import { Project } from './entities/project.entity';
import { EMPTY_PROFILE, fromYearMonth, toCandidateProfile } from './profile.mapper';

const RELATIONS = { education: true, skills: { skill: true }, projects: true } as const;

/**
 * Hồ sơ ứng viên 4 bước (mục 5.6 của đặc tả). Mỗi bước một PUT, thay toàn bộ dữ liệu của bước đó
 * trong một transaction, rồi đánh dấu bước đã xong. Hồ sơ tạo khi lưu bước đầu tiên.
 */
@Injectable()
export class ProfilesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async get(userId: string, lang: Locale): Promise<CandidateProfileDto> {
    const profile = await this.dataSource.getRepository(CandidateProfile).findOne({
      where: { userId },
      relations: RELATIONS,
    });
    return profile ? toCandidateProfile(profile, lang) : EMPTY_PROFILE;
  }

  /** Các bước đã xong; chưa có hồ sơ thì rỗng. Dùng khi kiểm điều kiện nộp đơn. */
  async completedSteps(userId: string): Promise<ProfileStep[]> {
    const profile = await this.dataSource.getRepository(CandidateProfile).findOne({
      where: { userId },
      select: { id: true, completedSteps: true },
    });
    return profile?.completedSteps ?? [];
  }

  saveBasic(userId: string, input: BasicProfileInput, lang: Locale): Promise<CandidateProfileDto> {
    return this.saveStep(userId, ProfileStep.BASIC, lang, async (manager, profile) => {
      await manager.getRepository(CandidateProfile).update(profile.id, {
        headline: input.headline,
        phone: input.phone ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        locationId: input.locationId ?? null,
        about: input.about ?? null,
        links: input.links,
      });
    });
  }

  saveEducation(
    userId: string,
    input: EducationStepInput,
    lang: Locale,
  ): Promise<CandidateProfileDto> {
    return this.saveStep(userId, ProfileStep.EDUCATION, lang, async (manager, profile) => {
      const repository = manager.getRepository(Education);
      await repository.delete({ profileId: profile.id });
      await repository.insert(
        input.items.map((item) => ({
          profileId: profile.id,
          school: item.school,
          major: item.major ?? null,
          degree: item.degree ?? null,
          startDate: fromYearMonth(item.startDate),
          endDate: item.endDate ? fromYearMonth(item.endDate) : null,
          gpa: item.gpa ?? null,
        })),
      );
    });
  }

  /** Kỹ năng không tồn tại: khóa ngoại chặn, filter trả 400 INVALID_REFERENCE. */
  saveSkills(userId: string, input: SkillsStepInput, lang: Locale): Promise<CandidateProfileDto> {
    return this.saveStep(userId, ProfileStep.SKILLS, lang, async (manager, profile) => {
      const repository = manager.getRepository(CandidateSkill);
      await repository.delete({ profileId: profile.id });
      await repository.insert(
        input.items.map((item) => ({
          profileId: profile.id,
          skillId: item.skillId,
          level: item.level,
        })),
      );
    });
  }

  saveProjects(
    userId: string,
    input: ProjectsStepInput,
    lang: Locale,
  ): Promise<CandidateProfileDto> {
    return this.saveStep(userId, ProfileStep.PROJECTS, lang, async (manager, profile) => {
      const repository = manager.getRepository(Project);
      await repository.delete({ profileId: profile.id });
      if (input.items.length === 0) return;
      await repository.insert(
        input.items.map((item) => ({
          profileId: profile.id,
          name: item.name,
          role: item.role ?? null,
          description: item.description ?? null,
          techStack: item.techStack,
          url: item.url ?? null,
          startDate: item.startDate ? fromYearMonth(item.startDate) : null,
          endDate: item.endDate ? fromYearMonth(item.endDate) : null,
        })),
      );
    });
  }

  /** Lấy (hoặc tạo) hồ sơ, ghi dữ liệu của bước, đánh dấu bước đã xong; tất cả trong một transaction. */
  private async saveStep(
    userId: string,
    step: ProfileStep,
    lang: Locale,
    write: (manager: EntityManager, profile: CandidateProfile) => Promise<void>,
  ): Promise<CandidateProfileDto> {
    await this.dataSource.transaction(async (manager) => {
      const profile = await this.getOrCreate(manager, userId);
      await write(manager, profile);
      const steps = profile.completedSteps.includes(step)
        ? profile.completedSteps
        : [...profile.completedSteps, step];
      await manager
        .getRepository(CandidateProfile)
        .update(profile.id, { completedSteps: steps, updatedAt: new Date() });
    });
    return this.get(userId, lang);
  }

  /**
   * Tạo hồ sơ rỗng nếu chưa có. `INSERT ... ON CONFLICT DO NOTHING` nên hai request cùng lúc
   * (bấm lưu hai lần) không tạo hai hồ sơ; rồi khóa dòng để các bước ghi lần lượt.
   */
  private async getOrCreate(manager: EntityManager, userId: string): Promise<CandidateProfile> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(CandidateProfile)
      .values({ userId, links: [], completedSteps: [] })
      .orIgnore()
      .execute();
    return manager
      .getRepository(CandidateProfile)
      .createQueryBuilder('profile')
      .setLock('pessimistic_write')
      .where('profile.userId = :userId', { userId })
      .getOneOrFail();
  }
}
