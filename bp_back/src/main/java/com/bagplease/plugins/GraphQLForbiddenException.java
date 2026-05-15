package com.bagplease.plugins;

import graphql.ErrorType;
import graphql.GraphQLError;
import graphql.language.SourceLocation;

import java.util.List;
import java.util.Map;
/**
 * Java implementation.
 * Unable to implement GraphQL conflict exception in Kotlin
 * <a href="https://youtrack.jetbrains.com/issue/KT-6653/Kotlin-properties-do-not-override-Java-style-getters-and-setters">reason</a>
 */
public class GraphQLForbiddenException extends RuntimeException implements GraphQLError {
    public GraphQLForbiddenException(String message) {
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
        return Map.of("code", "FORBIDDEN");
    }
}
