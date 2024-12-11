plugins {
    alias(libs.plugins.kotlinJvm)
    alias(libs.plugins.ktor)
    alias(libs.plugins.kotlinxSerialization)
    application
}

group = "com.bag_please"
version = "1.0.0"
application {
    mainClass.set("com.bag_please.ApplicationKt")
    applicationDefaultJvmArgs =
        listOf("-Dio.ktor.development=${extra["io.ktor.development"] ?: "false"}")
}

dependencies {
    implementation(projects.shared)
    implementation(libs.logback)
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)

    implementation(libs.kotlinx.serialization)
    implementation(libs.kotlinx.rpc.server)

    testImplementation(libs.ktor.server.tests)
    testImplementation(libs.kotlin.test.junit)
}