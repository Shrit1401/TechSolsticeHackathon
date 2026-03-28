import os

from locust import HttpUser, between, task


class UserBehavior(HttpUser):
    wait_time = between(0.3, 1.5)
    host = os.environ.get("LOCUST_HOST", "http://127.0.0.1:8000")

    def on_start(self):
        self.client.post("/failure-mode/error")

    @task(25)
    def make_payment(self):
        self.client.post("/pay")

    @task(2)
    def get_users(self):
        self.client.get("/users")

    @task(1)
    def health_check(self):
        self.client.get("/health")
