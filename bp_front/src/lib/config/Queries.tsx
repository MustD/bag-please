import {graphql} from '@/__generated__'

export const getApplicationConfigQuery = graphql(`query GetApplicationConfig {
    applicationConfig {
        registrationEnabled
    }
}`)

export const setRegistrationEnabledMutation = graphql(`mutation SetRegistrationEnabled($enabled: Boolean!) {
    setRegistrationEnabled(enabled: $enabled) {
        registrationEnabled
    }
}`)
