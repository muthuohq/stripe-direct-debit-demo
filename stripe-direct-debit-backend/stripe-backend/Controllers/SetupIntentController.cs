using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;

namespace stripe_backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SetupIntentController : ControllerBase
    {

        [HttpPost("create")]
        public async Task<IActionResult> CreateDirectDebitSetupIntent([FromBody] DirectDebitRequest? req)
        {
            try
            {
                if (req == null || string.IsNullOrEmpty(req.Name) || string.IsNullOrEmpty(req.Email))
                {
                    return BadRequest(new { error = "Name and Email are required" });
                }

                var resellerId = req.ResellerId ?? "default";
                Console.WriteLine($"Creating BACS Direct Debit Setup Intent for reseller: {resellerId}, Customer: {req.Name} ({req.Email})");

                // First, create or get customer
                var customerService = new CustomerService();
                Customer customer;

                // For demo purposes, we'll create a new customer each time
                // In production, you'd want to check if customer already exists
                var customerOptions = new CustomerCreateOptions
                {
                    Name = req.Name,
                    Email = req.Email,
                    Metadata = new Dictionary<string, string>
                    {
                        { "reseller_id", resellerId }
                    }
                };
                customer = customerService.Create(customerOptions);

                // Create Setup Intent with confirm = false for BACS Direct Debit
                var setupIntentService = new SetupIntentService();
                var setupIntentOptions = new SetupIntentCreateOptions
                {
                    Customer = customer.Id,
                    PaymentMethodTypes = new List<string> { "bacs_debit" },
                    Usage = "off_session",
                    Confirm = false, // This is key - we don't confirm immediately
                    Metadata = new Dictionary<string, string>
                    {
                        { "reseller_id", resellerId },
                        { "purpose", "direct_debit_mandate" }
                    }
                };

                var setupIntent = await setupIntentService.CreateAsync(setupIntentOptions);

                // Store for later use
                stripe_backend.Controllers.MandateStore.CustomerId = customer.Id;

                return Ok(new
                {
                    success = true,
                    customerId = customer.Id,
                    setupIntentId = setupIntent.Id,
                    clientSecret = setupIntent.ClientSecret,
                    message = "Setup Intent created successfully. Use client secret with Stripe Elements to collect payment details."
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating Setup Intent: {ex.Message}");
                return BadRequest(new { error = ex.Message });
            }
        }

        public class DirectDebitRequest
        {
            public string? Name { get; set; }
            public string? Email { get; set; }
            public string? ResellerId { get; set; }
        }
    }
}