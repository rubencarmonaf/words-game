import { TestBed } from '@angular/core/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { Avatar } from './avatar';

describe('Avatar', () => {
  let service: Avatar;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Avatar);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('exposes all 11 avatar fields across the 4 UI groups exactly once', () => {
    const fieldsInGroups = service.groups.flatMap((g) => g.fields);
    const fieldsInCategories = service.categories.map((c) => c.field);

    expect(fieldsInGroups.sort()).toEqual(fieldsInCategories.sort());
    expect(new Set(fieldsInGroups).size).toBe(fieldsInGroups.length);
  });

  it('renders a non-empty SVG string for the default avatar', () => {
    const svg = service.renderSvg(DEFAULT_AVATAR);
    expect(svg).toContain('<svg');
    expect(svg.length).toBeGreaterThan(100);
  });

  it('renderPreview only changes the requested field', () => {
    const svg = service.renderPreview(DEFAULT_AVATAR, 'backgroundColor', 'cc3f52');
    expect(svg).toContain('cc3f52');
  });
});
