import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmpresaMeComponent } from './admin-empresa.component';

describe('AdminEmpresaComponent', () => {
  let component: EmpresaMeComponent
  let fixture: ComponentFixture<EmpresaMeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmpresaMeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmpresaMeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
