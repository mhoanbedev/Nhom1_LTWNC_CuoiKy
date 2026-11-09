import { ProfileStep } from '../enums/enums';
import { profileCompletion } from './profile-completion';

describe('profileCompletion', () => {
  it('chưa làm bước nào: 0%, chưa nộp đơn được, thiếu 3 bước bắt buộc', () => {
    expect(profileCompletion([])).toMatchObject({
      percent: 0,
      canApply: false,
      missingRequired: ['BASIC', 'EDUCATION', 'SKILLS'],
    });
  });

  it('xong 3 bước bắt buộc: 75%, nộp đơn được dù chưa có dự án', () => {
    const result = profileCompletion([
      ProfileStep.SKILLS,
      ProfileStep.BASIC,
      ProfileStep.EDUCATION,
    ]);
    expect(result).toMatchObject({ percent: 75, canApply: true, missingRequired: [] });
    expect(result.steps).toEqual([
      { step: 'BASIC', completed: true, required: true },
      { step: 'EDUCATION', completed: true, required: true },
      { step: 'SKILLS', completed: true, required: true },
      { step: 'PROJECTS', completed: false, required: false },
    ]);
  });

  it('chỉ có dự án thì vẫn chưa nộp đơn được', () => {
    expect(profileCompletion([ProfileStep.PROJECTS])).toMatchObject({
      percent: 25,
      canApply: false,
    });
  });
});
