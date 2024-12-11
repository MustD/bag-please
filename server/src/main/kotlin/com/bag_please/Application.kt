package com.bag_please

import com.bag_please.rpc.UserService
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.rpc.krpc.ktor.server.RPC
import kotlinx.rpc.krpc.ktor.server.rpc
import kotlinx.rpc.krpc.serialization.json.json

fun main() {
    embeddedServer(Netty, port = SERVER_PORT, host = "127.0.0.1", module = Application::module).start(wait = true)
}

fun Application.module() {
    install(RPC)

    routing {
        get("/") {
            call.respondText("Ktor: ${Greeting().greet()}")
        }

        rpc("/api") {
            rpcConfig {
                serialization {
                    json()
                }
            }

            registerService<UserService> { ctx -> UserServiceImpl(ctx) }
        }
    }
}