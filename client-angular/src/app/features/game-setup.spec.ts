import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { GameSetup } from './game-setup';

function activatedRouteStub(mode: string) {
  return { snapshot: { paramMap: convertToParamMap({ mode }) } };
}

describe('GameSetup', () => {
  let component: GameSetup;
  let fixture: ComponentFixture<GameSetup>;

  async function setup(mode: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GameSetup],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRouteStub(mode) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameSetup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  it('should create', async () => {
    await setup('solo');
    expect(component).toBeTruthy();
  });

  it('shows the right title per mode', async () => {
    await setup('cadena');
    expect(component['title']()).toBe('Modo Cadena - Eliminación');
  });

  it('hides player config and names for solo mode', async () => {
    await setup('solo');
    expect(component['showPlayerConfig']()).toBe(false);
    expect(component['showPlayerNames']()).toBe(false);
  });

  it('shows player count but not names for cadena mode', async () => {
    await setup('cadena');
    expect(component['showPlayerConfig']()).toBe(true);
    expect(component['showPlayerNames']()).toBe(false);
  });

  it('shows player count and names for friendly mode', async () => {
    await setup('friendly');
    expect(component['showPlayerConfig']()).toBe(true);
    expect(component['showPlayerNames']()).toBe(true);
  });

  it('regenerates player name controls when player count changes', async () => {
    await setup('friendly');
    expect(component['playerNameControls'].length).toBe(2);

    component['form'].controls.playerCount.setValue(4);
    expect(component['playerNameControls'].length).toBe(4);

    component['form'].controls.playerCount.setValue(2);
    expect(component['playerNameControls'].length).toBe(2);
  });

  it('marks the prefix field as touched and does not start when the form is invalid', async () => {
    await setup('solo');
    component['submit']();
    expect(component['form'].controls.prefix.touched).toBe(true);
  });
});
