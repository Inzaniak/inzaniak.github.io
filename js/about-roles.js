(function () {
  "use strict";

  var roleDetails = {
    data: {
      number: "01 / Work",
      title: "Data",
      job: "I designed and delivered data platforms, analytical models, and reporting solutions. My work covered the full path from collecting and transforming raw information to building clear dashboards that help people make informed decisions.",
      customers: [
        "Enterprise reporting teams",
        "Business and operations stakeholders",
        "Colleagues and training participants"
      ],
      technologies: [
        "Power BI, DAX, and Power Query",
        "SQL, SSAS, and Azure Data Factory",
        "Python, Pandas, and ETL / ELT"
      ],
      skills: [
        "Data modelling and visualization",
        "Requirements analysis",
        "Teaching and technical enablement"
      ]
    },
    iot: {
      number: "02 / Work",
      title: "IoT",
      job: "I built cloud solutions that collect data from connected devices and make it available for centralized processing, monitoring, and analysis. I connected edge and cloud components while keeping reliability, scale, and real-time visibility in focus.",
      customers: [
        "Manufacturing and operations teams",
        "Connected-product teams",
        "Cloud data teams"
      ],
      technologies: [
        "Microsoft Azure",
        "Python and REST APIs",
        "Cloud-to-edge data integrations"
      ],
      skills: [
        "IoT solution design",
        "Data ingestion and processing",
        "Monitoring and troubleshooting"
      ]
    },
    ai: {
      number: "03 / Work",
      title: "AI",
      job: "As an AI Tech Lead, I shape the technical direction and develop generative AI solutions for real business scenarios. I turn early ideas into working prototypes and production-ready systems, guiding architecture, implementation, and delivery.",
      customers: [
        "Healthcare organizations",
        "Enterprise business teams",
        "Product and innovation teams"
      ],
      technologies: [
        "OpenAI API and large language models",
        "Python, LangChain, and RAG architectures",
        "Prompt engineering and PyTorch"
      ],
      skills: [
        "Technical leadership",
        "AI solution architecture",
        "Prototyping and delivery"
      ]
    }
  };

  var modal = document.getElementById("role-modal");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".grid-role[data-role]"));

  if (!modal || !cards.length) {
    return;
  }

  var kicker = document.getElementById("role-modal-kicker");
  var title = document.getElementById("role-modal-title");
  var job = document.getElementById("role-modal-job");
  var customers = document.getElementById("role-modal-customers");
  var technologies = document.getElementById("role-modal-technologies");
  var skills = document.getElementById("role-modal-skills");
  var closeButton = modal.querySelector("[data-role-modal-close]");
  var activeCard = null;

  function fillList(list, values) {
    list.textContent = "";
    values.forEach(function (value) {
      var item = document.createElement("li");
      item.textContent = value;
      list.appendChild(item);
    });
  }

  function openModal(card) {
    var details = roleDetails[card.getAttribute("data-role")];

    if (!details) {
      return;
    }

    activeCard = card;
    kicker.textContent = details.number;
    title.textContent = details.title;
    job.textContent = details.job;
    fillList(customers, details.customers);
    fillList(technologies, details.technologies);
    fillList(skills, details.skills);
    document.body.classList.add("role-modal-open");
    modal.showModal();
  }

  function closeModal() {
    modal.close();
  }

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      openModal(card);
    });

    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(card);
      }
    });
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  modal.addEventListener("close", function () {
    document.body.classList.remove("role-modal-open");
    if (activeCard) {
      activeCard.focus();
      activeCard = null;
    }
  });
}());
