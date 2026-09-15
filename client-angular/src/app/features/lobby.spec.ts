import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Lobby } from './lobby';

describe('Lobby', () => {
  let component: Lobby;
  let fixture: ComponentFixture<Lobby>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Lobby],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Lobby);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists the mock friends with their online status', () => {
    expect(component['friends']()).toEqual([
      { username: 'Amigo1', online: true },
      { username: 'Amigo2', online: false },
    ]);
  });

  it('invite() marks a friend as invited', () => {
    expect(component['isInvited']('Amigo1')).toBe(false);
    component['invite']('Amigo1');
    expect(component['isInvited']('Amigo1')).toBe(true);
  });

  it('renders the offline friend\'s invite button as disabled', () => {
    const el: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.invite-btn'));
    const offlineBtn = buttons.find((b) => b.textContent?.trim() === 'Invitar' && b.disabled);

    expect(offlineBtn).toBeTruthy();
  });

  it('clicking invite updates the button label and disables it', () => {
    const el: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.invite-btn'));
    const onlineBtn = buttons.find((b) => !b.disabled)!;

    onlineBtn.click();
    fixture.detectChanges();

    expect(onlineBtn.textContent?.trim()).toBe('Invitado');
    expect(onlineBtn.disabled).toBe(true);
  });
});
