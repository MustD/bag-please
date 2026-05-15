package com.bagplease.plugins;

import graphql.ErrorType;
import graphql.GraphQLError;
import graphql.language.SourceLocation;

import java.util.List;
import java.util.Map;

public class GraphQLInvalidInputException extends RuntimeException implements GraphQLError {
    public GraphQLInvalidInputException(String message) {
        super(message);
    }

    @Override
    public List<SourceLocation> getLocations() {
        return List.of();
    }

    @Override
    public graphql.ErrorClassification getErrorType() {
        return ErrorType.DataFetchingException;
    }

    @Override
    public Map<String, Object> getExtensions() {
        return Map.of("code", "BAD_USER_INPUT");
    }
}
