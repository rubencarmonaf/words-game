import { TestBed } from '@angular/core/testing';
import { WwRankEmblem } from './ww-rank-emblem';

describe('WwRankEmblem', () => {
  function render(elo: number): HTMLImageElement {
    const fixture = TestBed.createComponent(WwRankEmblem);
    fixture.componentRef.setInput('elo', elo);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('img') as HTMLImageElement;
  }

  it('shows the emblem of the tier that the ELO falls in, with an accessible name', () => {
    const img = render(1200);
    expect(img.getAttribute('src')).toBe('/assets/ranks/experto.png');
    expect(img.getAttribute('alt')).toBe('Rango Experto');
  });

  it('starts at Aprendiz and tops out at Mítico', () => {
    expect(render(0).getAttribute('src')).toBe('/assets/ranks/aprendiz.png');
    expect(render(9000).getAttribute('src')).toBe('/assets/ranks/mitico.png');
  });
});
