import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_AVATAR } from '@shared-types';
import { WwAvatar } from './ww-avatar';

describe('WwAvatar', () => {
  let component: WwAvatar;
  let fixture: ComponentFixture<WwAvatar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WwAvatar],
    }).compileComponents();

    fixture = TestBed.createComponent(WwAvatar);
    fixture.componentRef.setInput('options', DEFAULT_AVATAR);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the DiceBear SVG inside the .ww-avatar span', async () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ww-avatar svg')).toBeTruthy();
  });

  it('applies the requested size modifier class', async () => {
    fixture.componentRef.setInput('size', 'lg');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ww-avatar--lg')).toBeTruthy();
  });
});
