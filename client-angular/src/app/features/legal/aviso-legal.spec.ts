import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvisoLegal } from './aviso-legal';

describe('AvisoLegal', () => {
  let component: AvisoLegal;
  let fixture: ComponentFixture<AvisoLegal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvisoLegal],
    }).compileComponents();

    fixture = TestBed.createComponent(AvisoLegal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
