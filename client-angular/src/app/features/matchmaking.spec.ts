import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Matchmaking } from './matchmaking';

describe('Matchmaking', () => {
  let component: Matchmaking;
  let fixture: ComponentFixture<Matchmaking>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Matchmaking],
    }).compileComponents();

    fixture = TestBed.createComponent(Matchmaking);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
