import os

from locust import HttpUser, between, task


def _host() -> str:
    return os.environ.get("LOCUST_HOST", "http://127.0.0.1:8000")


def _profile() -> str:
    return os.environ.get("LOCUST_PROFILE", "all").strip().lower()


def _active(*profiles: str) -> bool:
    p = _profile()
    if p == "all":
        return True
    return p in profiles


class User(HttpUser):
    wait_time = between(0.2, 1.2)
    host = _host()

    @task(22)
    def pay(self):
        if not _active("payment", "pay", "gateway"):
            return
        self.client.post("/pay")

    @task(4)
    def users_list(self):
        if not _active("users", "user", "gateway"):
            return
        self.client.get("/users")

    @task(3)
    def orders_get(self):
        if not _active("orders", "order"):
            return
        self.client.get("/orders")

    @task(2)
    def orders_post(self):
        if not _active("orders", "order"):
            return
        self.client.post("/orders")

    @task(3)
    def inventory_get(self):
        if not _active("inventory"):
            return
        self.client.get("/inventory")

    @task(3)
    def notify_post(self):
        if not _active("notification", "notifications", "notify"):
            return
        self.client.post("/notify")

    @task(2)
    def notifications_get(self):
        if not _active("notification", "notifications", "notify"):
            return
        self.client.get("/notifications")

    @task(2)
    def auth_login(self):
        if not _active("auth"):
            return
        self.client.post("/login")

    @task(2)
    def auth_me(self):
        if not _active("auth"):
            return
        self.client.get("/me")

    @task(1)
    def health(self):
        if not _active("payment", "pay", "gateway"):
            return
        self.client.get("/health")
