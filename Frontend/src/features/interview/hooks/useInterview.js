import { getAllInterviewReports, generateInterviewReport, getInterviewReportById, generateResumePdf } from "../services/interview.api"
import { useContext, useEffect, useRef } from "react"
import { InterviewContext } from "../interview.context"
import { useParams } from "react-router"
import toast from "react-hot-toast"
import axios from "axios"


export const useInterview = () => {

    const context = useContext(InterviewContext)
    const { interviewId } = useParams()

    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider")
    }

    const { loading, setLoading, report, setReport, reports, setReports } = context

    // Holds the AbortController for the current in-flight generateReport request
    const abortControllerRef = useRef(null)

    const generateReport = async ({ jobDescription, selfDescription, resumeFile }) => {
        // Fresh controller for each request — previous one (if any) is already gone
        abortControllerRef.current = new AbortController()

        setLoading(true)
        let response = null
        try {
            response = await generateInterviewReport({
                jobDescription,
                selfDescription,
                resumeFile,
                signal: abortControllerRef.current.signal
            })
            setReport(response.interviewReport)
            toast.success("Interview report generated successfully!")
        } catch (error) {
            // axios.isCancel  → CancelToken cancellations (legacy)
            // 'CanceledError' → AbortController signal aborts (axios v1+)
            if (axios.isCancel(error) || error.name === 'CanceledError') {
                return null   // user cancelled — silent, no toast
            }
            const message = error.response?.data?.message || "Failed to generate report. Please try again."
            toast.error(message)
        } finally {
            setLoading(false)
            abortControllerRef.current = null
        }

        return response?.interviewReport
    }

    // Aborts the currently in-flight generateReport request
    const cancelGeneration = () => {
        abortControllerRef.current?.abort()
    }

    const getReportById = async (interviewId) => {
        setLoading(true)
        let response = null
        try {
            response = await getInterviewReportById(interviewId)
            setReport(response.interviewReport)
        } catch (error) {
            const message = error.response?.data?.message || "Failed to fetch report."
            toast.error(message)
        } finally {
            setLoading(false)
        }
        return response?.interviewReport
    }

    const getReports = async () => {
        setLoading(true)
        let response = null
        try {
            response = await getAllInterviewReports()
            setReports(response.interviewReports)
        } catch (error) {
            const message = error.response?.data?.message || "Failed to fetch reports."
            toast.error(message)
        } finally {
            setLoading(false)
        }

        return response?.interviewReports
    }

    const getResumePdf = async (interviewReportId) => {
        setLoading(true)
        try {
            const response = await generateResumePdf({ interviewReportId })
            const url = window.URL.createObjectURL(new Blob([ response ], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `resume_${interviewReportId}.pdf`)
            document.body.appendChild(link)
            link.click()
            toast.success("Resume downloaded successfully!")
        }
        catch (error) {
            const message = error.response?.data?.message || "Failed to download resume."
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        } else {
            getReports()
        }
    }, [ interviewId ])

    return { loading, report, reports, generateReport, cancelGeneration, getReportById, getReports, getResumePdf }

}