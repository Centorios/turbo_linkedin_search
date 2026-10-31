import pytest

from app.services.cv_photo import InvalidCvPhotoError, validate_cv_photo


OWNER = "00000000-0000-0000-0000-000000000001"
OTHER = "00000000-0000-0000-0000-000000000002"
FILE = "00000000-0000-0000-0000-000000000003.jpg"


class Storage:
    def __init__(self, names):
        self.names = names

    def list(self, owner, options):
        assert owner == OWNER
        assert options == {"search": FILE}
        return [{"name": name} for name in self.names]


class Client:
    def __init__(self, names):
        self.bucket = Storage(names)

    class StorageGroup:
        def __init__(self, bucket):
            self.bucket = bucket

        def from_(self, name):
            assert name == "profile-photos"
            return self.bucket

    @property
    def storage(self):
        return self.StorageGroup(self.bucket)


def test_owned_existing_photo_and_explicit_removal_are_accepted():
    validate_cv_photo(OWNER, f"{OWNER}/{FILE}", Client([FILE]))
    validate_cv_photo(OWNER, None, Client([]))


@pytest.mark.parametrize("path", [f"{OTHER}/{FILE}", f"{OWNER}/not-a-uuid.jpg", f"{OWNER}/{FILE}.png"])
def test_foreign_or_malformed_photo_is_rejected(path):
    with pytest.raises(InvalidCvPhotoError):
        validate_cv_photo(OWNER, path, Client([FILE]))


def test_missing_photo_object_is_rejected():
    with pytest.raises(InvalidCvPhotoError):
        validate_cv_photo(OWNER, f"{OWNER}/{FILE}", Client([]))
