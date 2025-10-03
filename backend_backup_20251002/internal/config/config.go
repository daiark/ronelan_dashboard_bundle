// internal/config/config.go
package config

import (
	"log"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DBConfig
	NATS     NATSConfig
}

type ServerConfig struct {
	Port string `mapstructure:"port"`
}

type DBConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
}

type NATSConfig struct {
	URL          string `mapstructure:"url"`
	StreamName   string `mapstructure:"stream_name"`
	ConsumerName string `mapstructure:"consumer_name"`
}

func LoadConfig() (*Config, error) {
	viper.SetConfigName("config")    // Name of config file (without extension)
	viper.SetConfigType("yaml")      // REQUIRED if the config file does not have the extension in the name
	viper.AddConfigPath("./configs") // Path to look for the config file in
	viper.AddConfigPath(".")         // Optionally look for config in the working directory

	// Enable environment variable overriding
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			log.Println("Config file not found; using environment variables")
		} else {
			return nil, err
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
