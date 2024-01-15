import * as core from '@actions/core'
import * as github from '@actions/github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Initialize Octokit with given auth token
    const token = core.getInput('authToken')
    const octokit = github.getOctokit(token)

    // Action inputs
    const filterByName = core.getInput('filterByName')
    const filterByWorkflowRunId = core.getInput('filterByWorkflowRunId')

    // Workflow context
    const contextIssue = github.context.issue

    // Get all artifacts of the repo
    const response = await octokit.rest.actions.listArtifactsForRepo({
      owner: contextIssue.owner,
      repo: contextIssue.repo
    })

    const deletedArtifacts = []
    for (const artifact of response.data.artifacts) {
      const printableArtifact: string = JSON.stringify({
        id: artifact.id,
        name: artifact.name,
        workflow_run_id: artifact.workflow_run?.id
      })
      core.debug(`Processing artifact: ${printableArtifact}`)

      // apply filter regex on artifact name
      const matchFilterByName: boolean =
        artifact.name.match(filterByName) != null
      core.debug(`Match filter regex on name: ${matchFilterByName}`)

      // apply filter regex on artifact workflow run id
      const matchFilterByWorkflowRunId: boolean =
        artifact.workflow_run?.id?.toString().match(filterByWorkflowRunId) !=
        null
      core.debug(
        `Match filter regex on workflow run id: ${matchFilterByWorkflowRunId}`
      )

      if (matchFilterByName && matchFilterByWorkflowRunId) {
        core.info(`Deleting artifact: ${printableArtifact}`)
        await octokit.rest.actions.deleteArtifact({
          owner: contextIssue.owner,
          repo: contextIssue.repo,
          artifact_id: artifact.id
        })
        deletedArtifacts.push(artifact)
      } else {
        core.debug(`Ignore artifact: ${printableArtifact}`)
      }
    }

    core.setOutput('deletedArtifacts', deletedArtifacts)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(JSON.stringify(error))
    }
  }
}
