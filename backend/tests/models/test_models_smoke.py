from __future__ import annotations

from app.models.case import Case
from app.models.case_client import CaseClient
from app.models.milestone import Milestone
from app.models.organization import Organization
from app.models.role import Role
from app.models.test import Test as TestModel
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_profile import UserProfile
from app.models.user_role import UserRole

TestModel.__test__ = False


def test_model_metadata_smoke():
    assert Organization.__tablename__ == 'organizations'
    assert User.__tablename__ == 'users'
    assert Case.__tablename__ == 'cases'
    assert Milestone.__tablename__ == 'milestones'
    assert Role.__tablename__ == 'roles'
    assert UserRole.__tablename__ == 'user_roles'
    assert UserProfile.__tablename__ == 'user_profiles'
    assert CaseClient.__tablename__ == 'case_clients'
    assert UserInvitation.__tablename__ == 'user_invitations'
    assert TestModel.__tablename__ == 'test'
