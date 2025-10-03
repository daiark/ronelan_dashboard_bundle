// internal/platform/taskqueue/liteq.go
package taskqueue

import (
	"context"
	"database/sql"
	"log"

	"github.com/khepin/liteq"
	_ "github.com/mattn/go-sqlite3"
)

// Setup initializes the liteq database and returns a queue instance.
func Setup(dbPath string) (*liteq.Queue, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err!= nil {
		return nil, err
	}

	if err := liteq.Setup(db); err!= nil {
		return nil, err	}

	return liteq.New(db), nil
}

// Example of starting a consumer for a specific queue
func StartReportConsumer(ctx context.Context, q *liteq.Queue) {
	log.Println("Starting report consumer...")
	go q.Consume(ctx, liteq.ConsumeParams{
		Queue:    "reports",
		PoolSize: 2, // Process 2 reports concurrently
		Worker: func(ctx context.Context, job *liteq.Job) error {
			log.Printf("Processing report job: %s", job.Payload)
			//... logic to generate the report...
			return nil
		},
	})
}
