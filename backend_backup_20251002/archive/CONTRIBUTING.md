# Contributing to CNC Monitor

Thank you for your interest in contributing to the CNC Monitor project! This document provides guidelines for contributing to this industrial IoT monitoring system.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/cnc-monitor.git
   cd cnc-monitor
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🏗️ Development Setup

### Backend Development
```bash
# Start the backend services
docker compose up --build

# Run tests
go run scripts/publish_test_data.go
go run scripts/performance.go
```

### Edge Agent Development
```bash
cd edge/agent
go mod tidy
go build -o cnc-edge-agent .

# Test with simulator
DEBUG=true ./cnc-edge-agent
```

## 🧪 Testing

### Backend Tests
- **Basic functionality**: `go run scripts/publish_test_data.go`
- **Performance**: `go run scripts/performance.go` (should achieve 40K+ msg/s)
- **Stress testing**: `go run scripts/stress.go`

### Edge Agent Tests
- **Unit tests**: `go test ./...` in edge/agent directory
- **Integration tests**: Run against live backend
- **Hardware tests**: Test on actual Raspberry Pi hardware

## 📝 Code Style

### Go Code Standards
- Follow standard Go formatting (`gofmt`)
- Use meaningful variable and function names
- Add comments for complex logic
- Write unit tests for new functionality

### Documentation
- Update relevant documentation for new features
- Include example configurations
- Add performance benchmarks where applicable

## 🔧 Pull Request Process

1. **Ensure tests pass**: All existing tests must continue to pass
2. **Add tests**: New functionality should include tests
3. **Update documentation**: Update README, architecture docs, etc.
4. **Performance verification**: Edge agent changes should maintain <50MB memory usage
5. **Industrial compatibility**: Changes should maintain industrial-grade reliability

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Backend tests pass
- [ ] Edge agent tests pass
- [ ] Performance benchmarks maintained
- [ ] Hardware compatibility verified (if applicable)

## Performance Impact
- Memory usage: 
- CPU usage:
- Throughput impact:
```

## 🏭 Industrial IoT Guidelines

### Reliability Requirements
- **Zero data loss** during network outages
- **Graceful degradation** under resource constraints
- **ACID-safe persistence** for critical data
- **Explicit error handling** for all failure modes

### Performance Standards
- **Backend**: Maintain 40K+ msg/s throughput
- **Edge Agent**: Stay under 50MB memory usage
- **Recovery time**: <5 seconds after network restoration
- **Offline operation**: Support 24+ hours autonomous operation

### Security Considerations
- No hardcoded credentials
- TLS support for production deployments
- Input validation for all external data
- Secure defaults in configuration

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment details**: OS, Go version, hardware specs
2. **Reproduction steps**: Exact steps to reproduce the issue
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Logs**: Relevant log output (with sensitive data removed)
6. **Configuration**: Relevant configuration files

## 💡 Feature Requests

For new features, please provide:

1. **Use case**: Why is this feature needed?
2. **Proposed solution**: How should it work?
3. **Alternatives considered**: Other approaches you considered
4. **Industrial impact**: How does this benefit industrial deployments?

## 📋 Areas for Contribution

### High Priority
- **Additional sensor types**: OPC UA, CAN bus, custom protocols
- **Edge ML capabilities**: Anomaly detection, predictive maintenance
- **Security enhancements**: Certificate management, encryption
- **Monitoring dashboards**: Real-time visualization

### Medium Priority
- **Protocol optimizations**: Compression algorithms, batching strategies
- **Deployment automation**: Kubernetes operators, Ansible playbooks
- **Testing frameworks**: Hardware-in-the-loop testing
- **Documentation**: Video tutorials, deployment guides

### Hardware Support
- **Raspberry Pi variants**: Pi Zero, Pi 5, Compute Module
- **Industrial gateways**: Specific hardware vendor support
- **Sensor drivers**: GPIO, I2C, SPI, Modbus implementations
- **Communication protocols**: LoRaWAN, Zigbee, WiFi optimization

## 🤝 Community Guidelines

- **Be respectful**: Treat all contributors with respect
- **Be constructive**: Provide helpful feedback and suggestions
- **Be patient**: Industrial IoT is complex - learning takes time
- **Share knowledge**: Help others learn and contribute

## 📚 Resources

### Documentation
- [Backend Architecture](ARCHITECTURE_BY_CLAUDE.md)
- [Edge Architecture](edge/docs/EDGE_ARCHITECTURE.md)
- [Edge Getting Started](edge/README.md)

### External Resources
- [NATS JetStream Documentation](https://docs.nats.io/jetstream)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Industrial IoT Best Practices](https://www.iiconsortium.org/)

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check existing documentation first

---

Thank you for contributing to industrial IoT innovation! 🏭