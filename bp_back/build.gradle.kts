import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.gradle.api.tasks.testing.logging.TestLogEvent
import org.gradle.api.tasks.testing.logging.TestLogging

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ktor)
}

group = "com.bagplease"

application {
    mainClass.set("io.ktor.server.netty.EngineMain")

    val isDevelopment: Boolean = project.ext.has("development")
    applicationDefaultJvmArgs = listOf("-Dio.ktor.development=$isDevelopment")
}

kotlin {
    jvmToolchain(25)
}

repositories {
    mavenCentral()
}

// Operator-run Mongo export importer (Story 11.8). Its own source set so it is compiled against `main` but never
// lands in `installDist` / the bp_back image, which only packages `main`.
val importSet: SourceSet = sourceSets.create("import") {
    compileClasspath += sourceSets.main.get().output + configurations.compileClasspath.get()
    runtimeClasspath += output + sourceSets.main.get().output + configurations.runtimeClasspath.get()
}

sourceSets.test {
    compileClasspath += importSet.output
    runtimeClasspath += importSet.output
}

dependencies {
    implementation(libs.arrow.core)
    implementation(libs.arrow.fx.coroutines)

    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.auth)
    implementation(libs.ktor.server.auth.jwt)
    implementation(libs.ktor.server.cors)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.jackson)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.websockets)
    implementation(libs.ktor.server.di)
    implementation(libs.ktor.server.rate.limit)
    implementation(libs.ktor.server.forwarded.header)
    implementation(libs.bcrypt)
    implementation(libs.graphql.kotlin.ktor.server)
    implementation(libs.logback.classic)

    implementation(libs.exposed.core)
    implementation(libs.exposed.r2dbc)
    implementation(libs.exposed.java.time)
    implementation(libs.r2dbc.postgresql)
    implementation(libs.r2dbc.pool)
    // Blocking JDBC exists only for Flyway (AD-8).
    implementation(libs.flyway.core)
    implementation(libs.flyway.database.postgresql)
    runtimeOnly(libs.postgresql.jdbc)

    testImplementation(libs.ktor.server.test)
    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.property)
    testImplementation(libs.kotest.assertions.ktor)
    testImplementation(libs.testcontainers.postgresql)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()

    // One line per test instead of a wall of application logs. The `quiet` block is the
    // one that matters: `back:test` runs gradle with -q, and test logging is configured
    // per log level, so events set only on the default (lifecycle) level would be hidden.
    testLogging {
        fun TestLogging.testList() {
            events(
                TestLogEvent.PASSED,
                TestLogEvent.FAILED,
                TestLogEvent.SKIPPED,
            )
            exceptionFormat = TestExceptionFormat.SHORT
            showStandardStreams = false
            showStackTraces = false
        }
        testList()
        quiet { testList() }
    }
}

// Prints the importer's runtime classpath (used by mise/db_import.sh to start it with plain `java`).
tasks.register("importClasspath") {
    val classpath = importSet.runtimeClasspath
    dependsOn(tasks.named("importClasses"))
    doLast { println(classpath.asPath) }
}
