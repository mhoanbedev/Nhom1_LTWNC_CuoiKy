import {
  basicProfileSchema,
  educationStepSchema,
  PROFILE_STEPS,
  projectsStepSchema,
  skillsStepSchema,
} from '@ltwnc/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class BasicProfileDto extends createZodDto(basicProfileSchema) {}
export class EducationStepDto extends createZodDto(educationStepSchema) {}
export class SkillsStepDto extends createZodDto(skillsStepSchema) {}
export class ProjectsStepDto extends createZodDto(projectsStepSchema) {}

/** Chỉ để mô tả trên Swagger; kiểu thật là CandidateProfile trong @ltwnc/shared. */
const yearMonth = z.string().meta({ example: '2024-09' });
const step = z.enum(PROFILE_STEPS);

export class CandidateProfileDto extends createZodDto(
  z.object({
    basic: z
      .object({
        headline: z.string(),
        phone: z.string().nullable(),
        dateOfBirth: z.iso.date().nullable(),
        locationId: z.uuid().nullable(),
        about: z.string().nullable(),
        links: z.array(z.object({ label: z.string(), url: z.url() })),
      })
      .nullable(),
    education: z.array(
      z.object({
        id: z.uuid(),
        school: z.string(),
        major: z.string().nullable(),
        degree: z.string().nullable(),
        startDate: yearMonth,
        endDate: yearMonth.nullable(),
        gpa: z.number().nullable(),
      }),
    ),
    skills: z.array(
      z.object({ skillId: z.uuid(), slug: z.string(), name: z.string(), level: z.number().int() }),
    ),
    projects: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        role: z.string().nullable(),
        description: z.string().nullable(),
        techStack: z.array(z.string()),
        url: z.url().nullable(),
        startDate: yearMonth.nullable(),
        endDate: yearMonth.nullable(),
      }),
    ),
    completion: z.object({
      steps: z.array(z.object({ step, completed: z.boolean(), required: z.boolean() })),
      percent: z.number().int(),
      canApply: z.boolean(),
      missingRequired: z.array(step),
    }),
    updatedAt: z.iso.datetime().nullable(),
  }),
) {}
