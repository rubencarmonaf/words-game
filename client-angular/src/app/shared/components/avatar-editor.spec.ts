import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { AvatarEditor } from './avatar-editor';

describe('AvatarEditor', () => {
  let component: AvatarEditor;
  let fixture: ComponentFixture<AvatarEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarEditor);
    fixture.componentRef.setInput('value', { ...DEFAULT_AVATAR });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts on the "Cara" group and shows its 5 fields', () => {
    const el: HTMLElement = fixture.nativeElement;
    const labels = Array.from(el.querySelectorAll('.ww-avatar-section-label')).map(
      (n) => n.textContent,
    );
    expect(labels).toEqual(['Piel', 'Ojos', 'Cejas', 'Boca', 'Vello facial']);
  });

  it('switching to the "Fondo" group renders color swatches, not thumbnails', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('.ww-avatar-tab'));
    const backgroundTab = tabs.find((btn) => btn.textContent?.trim() === 'Fondo')!;
    backgroundTab.click();
    await fixture.whenStable();

    expect(el.querySelector('.ww-avatar-swatch-grid')).toBeTruthy();
    expect(el.querySelector('.ww-avatar-thumb-grid')).toBeFalsy();
  });

  it('clicking a swatch updates the value output', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('.ww-avatar-tab'));
    const backgroundTab = tabs.find((btn) => btn.textContent?.trim() === 'Fondo')!;
    backgroundTab.click();
    await fixture.whenStable();

    const swatch = el.querySelector<HTMLButtonElement>('.ww-avatar-swatch')!;
    swatch.click();
    await fixture.whenStable();

    expect(component.value().backgroundColor).toBe('4a90e2');
  });
});
