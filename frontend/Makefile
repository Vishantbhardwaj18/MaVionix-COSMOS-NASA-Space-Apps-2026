.PHONY: run demo check test build docker clean
run:      ## live mode on http://localhost:3000
	./run.sh
demo:     ## offline sample mode
	./run.sh demo
check:    ## can this machine reach the SPHEREx archive and JPL?
	./run.sh check
test:     ## backend tests, frontend types, lint and build
	cd backend && python -m pytest -q
	cd frontend && npm run typecheck && npm run lint && npm run build
docker:
	docker compose up --build
clean:
	rm -rf frontend/.next backend/.pytest_cache && find . -name __pycache__ -type d -prune -exec rm -rf {} +
