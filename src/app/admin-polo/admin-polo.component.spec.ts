import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPoloComponent } from './admin-polo.component';

describe('AdminPoloComponent', () => {
  let component: AdminPoloComponent;
  let fixture: ComponentFixture<AdminPoloComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPoloComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminPoloComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
