DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS linen_history;
DROP TABLE IF EXISTS task_linen;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS listings;

CREATE TABLE listings
(
    listing_id      VARCHAR(64)  NOT NULL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    linen_attribute VARCHAR(255) NOT NULL
);

CREATE TABLE reservations
(
    reservation_id         VARCHAR(64) NOT NULL PRIMARY KEY,
    listing_id             VARCHAR(64) NOT NULL,
    status                 VARCHAR(32) NOT NULL,
    planned_arrival_time   DATETIME(3) NOT NULL,
    planned_departure_time DATETIME(3) NOT NULL,
    guests_count           INT         NOT NULL,
    infants                INT         NOT NULL,
    custom_fields          JSON        NOT NULL,
    INDEX                  idx_reservations_listing_arrival (listing_id, planned_arrival_time),
    CONSTRAINT fk_reservations_listing FOREIGN KEY (listing_id) REFERENCES listings (listing_id)
);

CREATE TABLE tasks
(
    task_id        VARCHAR(64) NOT NULL PRIMARY KEY,
    task_type      VARCHAR(64) NOT NULL,
    status         VARCHAR(32) NOT NULL,
    listing_id     VARCHAR(64) NULL,
    reservation_id VARCHAR(64) NULL,
    planned_start  DATETIME(3) NOT NULL,
    INDEX          idx_tasks_reservation (reservation_id)
);

CREATE TABLE task_linen
(
    task_id                   VARCHAR(64) NOT NULL PRIMARY KEY,
    sheets                    INT         NOT NULL,
    towels                    INT         NOT NULL,
    bathmats                  INT         NOT NULL,
    handtowels                INT         NOT NULL,
    dishtowels                INT         NOT NULL,
    prepared_for_guests       INT         NOT NULL,
    requested_sofabeds_count  INT         NOT NULL,
    actual_guests             INT         NOT NULL,
    infants                   INT         NOT NULL,
    number_of_guests_override INT NULL,
    requested_sofabed         BOOLEAN     NOT NULL,
    CONSTRAINT fk_task_linen_task FOREIGN KEY (task_id) REFERENCES tasks (task_id)
);

CREATE TABLE linen_history
(
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id    VARCHAR(64)  NOT NULL,
    event_id   VARCHAR(64) NULL,
    reason     VARCHAR(255) NOT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    created_at DATETIME(3)  NOT NULL,
    CONSTRAINT fk_linen_history_task FOREIGN KEY (task_id) REFERENCES tasks (task_id)
);

CREATE TABLE processed_events
(
    event_id VARCHAR(64) NOT NULL PRIMARY KEY
);