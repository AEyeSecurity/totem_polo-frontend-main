import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { LogoutButtonComponent } from './logout-button.component';
import { AuthenticationService } from '../../auth/auth.service';

describe('LogoutButtonComponent', () => {
  let component: LogoutButtonComponent;
  let fixture: ComponentFixture<LogoutButtonComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthenticationService', [
      'logout',
    ]);

    await TestBed.configureTestingModule({
      imports: [LogoutButtonComponent],
      providers: [
        { provide: AuthenticationService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LogoutButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open the confirmation modal when the button is clicked', () => {
    expect(component.showModal).toBeFalse();
    component.showModal = true;
    expect(component.showModal).toBeTrue();
  });

  it('should close the modal without logging out on cancel', () => {
    component.showModal = true;
    component.cancelLogout();

    expect(component.showModal).toBeFalse();
    expect(authServiceSpy.logout).not.toHaveBeenCalled();
  });

  it('should call the auth service and close the modal on confirm', () => {
    authServiceSpy.logout.and.returnValue(of(true));
    component.showModal = true;

    component.confirmLogout();

    expect(component.showModal).toBeFalse();
    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('should not trigger a second logout while one is already in progress', () => {
    authServiceSpy.logout.and.returnValue(of(true));
    component.loading = true;

    component.confirmLogout();

    expect(authServiceSpy.logout).not.toHaveBeenCalled();
  });
});
